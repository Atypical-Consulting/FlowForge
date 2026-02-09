import { Box, File, FileArchive, FileImage } from "lucide-react";
import { registerPreview } from "../../../lib/previewRegistry";

const binaryExts = /\.(exe|dll|so|dylib|bin|dat|wasm)$/i;
const imageExts = /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i;
const archiveExts = /\.(nupkg|zip|tar|gz|7z|rar)$/i;
const model3dExts = /\.(glb|gltf)$/i;

registerPreview({
  key: "binary",
  priority: 10,
  mode: "placeholder",
  matches: (filePath) => binaryExts.test(filePath),
  placeholder: {
    icon: File,
    message: "Binary file — click to expand",
  },
});

registerPreview({
  key: "image",
  priority: 10,
  mode: "placeholder",
  matches: (filePath) => imageExts.test(filePath),
  placeholder: {
    icon: FileImage,
    message: "Image file — click to expand for preview",
  },
});

registerPreview({
  key: "archive",
  priority: 10,
  mode: "placeholder",
  matches: (filePath) => archiveExts.test(filePath),
  placeholder: {
    icon: FileArchive,
    message: "Archive file — click to expand",
  },
});

registerPreview({
  key: "3d",
  priority: 10,
  mode: "placeholder",
  matches: (filePath) => model3dExts.test(filePath),
  placeholder: {
    icon: Box,
    message: "3D model — click to expand for viewer",
  },
});

registerPreview({
  key: "text-diff",
  priority: -100,
  mode: "inline-diff",
  matches: () => true,
});
