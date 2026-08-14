import Foundation
import Testing
@testable import HogarFinanzas

@MainActor
struct BootstrapTests {
    @Test("AppEnvironment provides the configured logging subsystem")
    func appEnvironmentProvidesLoggers() {
        let environment = AppEnvironment()

        #expect(environment.loggers.subsystem == "com.david.HogarFinanzas")
    }

    @Test("The app defines the five unique MVP tabs")
    func appDefinesFiveUniqueTabs() {
        let tabs = AppTab.allCases

        #expect(tabs.count == 5)
        #expect(Set(tabs.map(\.title)).count == 5)
        #expect(tabs.map(\.title) == ["Inicio", "Movimientos", "Plan", "Objetivos", "Análisis"])
    }
}
