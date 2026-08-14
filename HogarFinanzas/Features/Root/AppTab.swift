enum AppTab: String, CaseIterable, Identifiable {
    case home
    case transactions
    case plan
    case goals
    case analytics

    var id: Self { self }

    var title: String {
        switch self {
        case .home: "Inicio"
        case .transactions: "Movimientos"
        case .plan: "Plan"
        case .goals: "Objetivos"
        case .analytics: "Análisis"
        }
    }

    var systemImageName: String {
        switch self {
        case .home: "house"
        case .transactions: "list.bullet.rectangle"
        case .plan: "calendar"
        case .goals: "target"
        case .analytics: "chart.xyaxis.line"
        }
    }

    var placeholderMessage: String {
        switch self {
        case .home: "Aquí verás el resumen de las finanzas del hogar."
        case .transactions: "Aquí podrás consultar y registrar movimientos."
        case .plan: "Aquí podrás preparar y seguir el plan mensual."
        case .goals: "Aquí podrás seguir los objetivos del hogar."
        case .analytics: "Aquí podrás consultar la evolución financiera."
        }
    }
}
