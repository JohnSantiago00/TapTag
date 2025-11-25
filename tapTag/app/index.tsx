import { Redirect } from "expo-router";

export default function Index() {
  // Redirect user immediately to signup page on app launch
  return <Redirect href="/(auth)/SignUp" />;
}
