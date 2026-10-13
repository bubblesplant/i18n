import { ConfigProvider, Spin } from "antd";
import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./router";

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#315bfa" } }}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Spin />
          </div>
        }
      >
        <RouterProvider router={router} />
      </Suspense>
    </ConfigProvider>
  );
}
