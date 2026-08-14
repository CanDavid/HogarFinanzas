import SwiftUI

struct RootTabView: View {
    @State private var selection = AppTab.home

    var body: some View {
        TabView(selection: $selection) {
            ForEach(AppTab.allCases) { tab in
                NavigationStack {
                    PlaceholderTabView(tab: tab)
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.systemImageName)
                }
                .tag(tab)
            }
        }
        .accessibilityIdentifier("mainTabView")
    }
}

#Preview {
    RootTabView()
        .environment(PreviewFixtures.environment)
}
