import XCTest

final class BootstrapUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAppLaunchesAndNavigatesAcrossAllTabs() {
        let app = XCUIApplication()
        app.launch()

        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 5))

        for title in ["Inicio", "Movimientos", "Plan", "Objetivos", "Análisis"] {
            let tabButton = tabBar.buttons[title]
            XCTAssertTrue(tabButton.exists, "Missing tab: \(title)")
            tabButton.tap()
            XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 2))
        }
    }
}
