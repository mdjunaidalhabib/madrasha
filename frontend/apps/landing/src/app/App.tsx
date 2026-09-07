import { createBrowserRouter, RouterProvider } from "react-router-dom";
import QmsLandingPage from "../features/landing/QmsLandingPage";

const router = createBrowserRouter([
  { path: "/", element: <QmsLandingPage /> },
  { path: "*", element: <QmsLandingPage /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
