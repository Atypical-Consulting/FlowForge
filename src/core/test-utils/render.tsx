import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import { MotionConfig } from "framer-motion";
import type { ReactElement, ReactNode } from "react";
import { NavigationProvider } from "@/framework/layout/navigation/context";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function AllTheProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <MotionConfig reducedMotion="always">{children}</MotionConfig>
      </NavigationProvider>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from RTL
export * from "@testing-library/react";
// Override render with custom version
export { customRender as render };
