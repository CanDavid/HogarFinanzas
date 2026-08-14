import Observation

@MainActor
@Observable
final class AppEnvironment {
    let loggers: AppLoggers

    init(loggers: AppLoggers = AppLoggers()) {
        self.loggers = loggers
    }
}
