import { defineBilingualText } from "@madrasha/shared-ui/src/i18n";

export const loginText = defineBilingualText({
  bn: {
    title: "সুপার অ্যাডমিন লগইন",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    showPassword: "পাসওয়ার্ড দেখান",
    hidePassword: "পাসওয়ার্ড লুকান",
    login: "লগইন",
    loggingIn: "লগইন হচ্ছে...",
    tokenMissing: "লগইন রেসপন্সে টোকেন পাওয়া যায়নি",
    loginFailed: "লগইন ব্যর্থ হয়েছে",
  },
  en: {
    title: "Super Admin Login",
    email: "Email",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    login: "Login",
    loggingIn: "Logging in...",
    tokenMissing: "Token missing from login response",
    loginFailed: "Login failed",
  },
});
