import { lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";

const Home = lazy(() => import("@/pages/home"));

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/home" replace /> },
  { path: "/home", element: <Home /> },
]);
