import { useEffect, useState } from "react";
import { checkAdminSession } from "@/lib/admin-auth";

export function useAdminSession() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAdminSession().then((authenticated) => {
      setIsAdminAuthenticated(authenticated);
      setIsLoading(false);
    });
  }, []);

  return { isAdminAuthenticated, isLoading };
}
