import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // ⚠️ Don't log API routes as errors
    if (!location.pathname.startsWith('/api/')) {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname]);

  // ⚠️ If it's an API route, don't show the 404 page at all
  if (location.pathname.startsWith('/api/')) {
    return null; // Return nothing for API routes
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;