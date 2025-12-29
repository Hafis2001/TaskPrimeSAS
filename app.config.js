module.exports = {
  expo: {
     owner: "demoadila",  
    name: "TaskSAS",
    slug: "TaskSAS1",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/app-icon.png",
    scheme: "tasksas",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      backgroundColor: "#ffffff",
      bundleIdentifier: "com.hafis2001.TaskSAS",
      infoPlist: {
        UIViewControllerBasedStatusBarAppearance: true,
        UIStatusBarStyle: "UIStatusBarStyleLightContent"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.hafis2001.TaskSAS",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_PHONE_STATE"
      ]
    },
    web: {
      favicon: "./assets/images/app-icon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
      "expo-sqlite"
    ],
    extra: {
      router: {},
      eas: {
        projectId: "aca0c95c-06e4-4cef-b0bb-6a40dd9cf18b"
      }
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    }
  }
};