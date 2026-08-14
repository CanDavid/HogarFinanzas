import SwiftUI

struct PlaceholderTabView: View {
    let tab: AppTab

    var body: some View {
        ContentUnavailableView(
            tab.title,
            systemImage: tab.systemImageName,
            description: Text(tab.placeholderMessage)
        )
        .accessibilityIdentifier("screen.\(tab.rawValue)")
        .navigationTitle(tab.title)
    }
}
