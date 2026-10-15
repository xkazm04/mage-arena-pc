plugins {
    id("com.android.application")
}

// The page the shell opens. The default reaches the dev server on this PC through
// `adb reverse tcp:5173 tcp:5173`, so no firewall port has to open; tv.ps1 sets the tunnel up.
// Override with -PgameUrl=... at build time or `--es url ...` at launch.
val gameUrl = (project.findProperty("gameUrl") as String?) ?: "http://127.0.0.1:5173/"

android {
    namespace = "dev.magearena.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.magearena.tv"
        // Fire OS 7 == Android 9 (API 28); Fire OS 8 == Android 11 (API 30).
        minSdk = 28
        targetSdk = 34
        versionCode = 1
        versionName = "0.1"
        buildConfigField("String", "GAME_URL", "\"$gameUrl\"")
    }

    buildTypes {
        release { isMinifyEnabled = false }
        debug { isMinifyEnabled = false }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
