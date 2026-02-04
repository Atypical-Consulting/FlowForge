---
phase: quick-013
plan: 013
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/viewers/NugetPackageViewer.tsx
autonomous: true
---

# Quick Task 013: Fix NuGet Viewer Link and Download Count

## Problem
1. "View on NuGet.org" link redirected to GitHub (projectUrl) instead of NuGet.org
2. Download count showed 0 because registration API doesn't include totalDownloads

## Solution
1. Generate NuGet.org URL directly: `https://www.nuget.org/packages/${packageId}`
2. Use search API (`azuresearch-usnc.nuget.org/query`) which provides correct totalDownloads
3. Show both NuGet.org link and GitHub/Project link separately

## Tasks
1. Switch from registration API to search API for package metadata
2. Generate correct NuGet.org URL
3. Add GitHub icon for project URL distinction
