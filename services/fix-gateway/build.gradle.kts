plugins {
    application
}

group = "eg.agyal"
version = "0.0.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

repositories {
    mavenCentral()
}

val quickfixjVersion = "2.3.2"

dependencies {
    implementation("org.quickfixj:quickfixj-core:$quickfixjVersion")
    implementation("org.quickfixj:quickfixj-messages-fix44:$quickfixjVersion")
    implementation("org.slf4j:slf4j-simple:2.0.16")

    testImplementation(platform("org.junit:junit-bom:5.11.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
    mainClass.set("eg.agyal.fixgateway.GatewayApplication")
}

tasks.register<JavaExec>("runSimulator") {
    group = "application"
    description = "Runs the local bank FIX simulator (acceptor)."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("eg.agyal.fixgateway.simulator.BankSimulator")
}

tasks.test {
    useJUnitPlatform()
}
