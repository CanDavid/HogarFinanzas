import SwiftUI

@main
struct HogarFinanzasApp: App {
    @State private var environment = AppEnvironment()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(environment)
                .task {
                    environment.loggers.ui.info("Application launched")
                }
        }
    }
}
