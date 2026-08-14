import OSLog

struct AppLoggers {
    let subsystem: String
    let persistence: Logger
    let cloudKit: Logger
    let sharing: Logger
    let finance: Logger
    let ui: Logger

    init(subsystem: String = "com.david.HogarFinanzas") {
        self.subsystem = subsystem
        persistence = Logger(subsystem: subsystem, category: "persistence")
        cloudKit = Logger(subsystem: subsystem, category: "cloudkit")
        sharing = Logger(subsystem: subsystem, category: "sharing")
        finance = Logger(subsystem: subsystem, category: "finance")
        ui = Logger(subsystem: subsystem, category: "ui")
    }
}
