import ExpoModulesCore

/// iOS does not allow third-party apps to read SMS; Kharcha falls back to email + manual entry.
public class KharchaSmsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KharchaSms")

    Function("isAvailable") { false }
    Function("hasNotificationAccess") { false }
    Function("openNotificationAccessSettings") { false }
    Function("clearNotifications") { true }
    AsyncFunction("readNotifications") { (_: Double, _: Int) -> [[String: Any]] in
      []
    }

    AsyncFunction("readInbox") { (_: Double, _: Int, _: [String]) -> [[String: Any]] in
      []
    }
  }
}
