const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch the monorepo root for hoisted packages
config.watchFolders = [monorepoRoot]

// Resolve packages from both local and hoisted node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Force ALL react imports (from any package, hoisted or local) to resolve
// to mobile's local react@19.1.0 which matches react-native's bundled renderer.
// Without this, hoisted packages (zustand, expo-router, etc.) resolve react@19.2.4
// from the root node_modules, causing version mismatch crashes.
const mobileReact = path.resolve(projectRoot, 'node_modules/react')
const mobileReactNative = path.resolve(projectRoot, 'node_modules/react-native')

const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const redirected = moduleName === 'react'
      ? mobileReact
      : path.join(mobileReact, moduleName.slice('react'.length))
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      redirected,
      platform,
    )
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
