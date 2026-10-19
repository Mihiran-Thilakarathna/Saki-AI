allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Align plugin modules with :app so one SDK setup builds everything:
//  - NDK: plugins (e.g. :jni) default to Flutter's 27.0.x; 27.1 is backward compatible.
//  - compileSdk: plugins pinned to 35 compile fine against 36 (compile-time only; no runtime change).
// Registered before each plugin's own script runs, so it lands ahead of AGP's own checks.
subprojects {
    afterEvaluate {
        extensions.findByType<com.android.build.gradle.BaseExtension>()?.let { android ->
            android.ndkVersion = "27.1.12297006"
            val compileApi = android.compileSdkVersion?.removePrefix("android-")?.toIntOrNull()
            if (compileApi != null && compileApi < 36) android.compileSdkVersion(36)
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
