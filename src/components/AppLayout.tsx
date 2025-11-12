import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, Upload, History, User, LogOut, Menu, X, MapPin, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userInitials, setUserInitials] = useState<string>("U");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function computeInitials(name?: string | null, email?: string | null) {
    const source = (name && name.trim().length > 0 ? name : email) || "User";
    const parts = source.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || "");
      // Fast path from localStorage (kept in sync by Profile page)
      const cached = localStorage.getItem("avatar_url") || "";
      if (cached) setAvatarUrl(cached);

      // Fetch latest profile avatar and name
      try {
        const sb: any = supabase;
        const { data } = await sb
          .from("profiles")
          .select("avatar_url, full_name")
          .eq("id", user.id)
          .maybeSingle();

        setUserInitials(computeInitials(data?.full_name, user.email));
        if (data?.avatar_url) {
          localStorage.setItem("avatar_url", data.avatar_url);
          setAvatarUrl(data.avatar_url);
        } else if (!cached) {
          setAvatarUrl("");
        }
      } catch {
        setUserInitials(computeInitials(undefined, user.email));
      }
    };

    init();

    // Listen for avatar changes triggered elsewhere (Profile page)
    const onAvatarChanged = (e: Event) => {
      const next = (e as CustomEvent<string>).detail || "";
      if (next) localStorage.setItem("avatar_url", next);
      else localStorage.removeItem("avatar_url");
      setAvatarUrl(next);
    };
    window.addEventListener("avatar:changed", onAvatarChanged);

    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === "avatar_url") setAvatarUrl(e.newValue || "");
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("avatar:changed", onAvatarChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      // Clear avatar cache on signout
      localStorage.removeItem("avatar_url");
      setAvatarUrl("");
      setUserEmail("");
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  const navItems = [
    { path: "/upload", label: "Upload", icon: Upload },
    { path: "/history", label: "History", icon: History },
    { path: "/nearby", label: "Nearby", icon: MapPin },
    { path: "/profile", label: "Profile", icon: User },
  ];

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map((item) => (
        <Button
          key={item.path}
          variant={location.pathname === item.path ? "default" : "ghost"}
          onClick={() => {
            navigate(item.path);
            if (mobile) setMobileMenuOpen(false);
          }}
          className={mobile ? "w-full justify-start" : ""}
        >
          <item.icon className="h-4 w-4 mr-2" />
          {item.label}
        </Button>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="medical-container py-4">
          <div className="flex justify-between items-center">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <Activity className="h-6 w-6 text-primary" />
              {/* Branding unified: DermaVision (not DermaVision AI) */}
              <span className="font-bold text-xl">DermaVision</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-3">
              <NavLinks />
              <div className="h-6 w-px bg-border mx-2" />
              <div className="flex items-center gap-3">
                {userEmail ? (
                  <>
                    <span className="text-sm text-muted-foreground">{userEmail}</span>
                    <button
                      type="button"
                      onClick={() => navigate("/profile")}
                      className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                      aria-label="Open profile"
                    >
                      <Avatar className="h-8 w-8">
                        {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                    </button>
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Button variant="default" size="sm" onClick={() => navigate("/auth")}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-4 mt-6">
                    {userEmail ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
                          <AvatarFallback>{userInitials}</AvatarFallback>
                        </Avatar>
                        <div className="text-sm text-muted-foreground">{userEmail}</div>
                      </div>
                    ) : null}

                    <NavLinks mobile />

                    <div className="pt-4 border-t border-border">
                      {userEmail ? (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            handleSignOut();
                            setMobileMenuOpen(false);
                          }}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          className="w-full justify-start"
                          onClick={() => {
                            navigate("/auth");
                            setMobileMenuOpen(false);
                          }}
                        >
                          <LogIn className="h-4 w-4 mr-2" />
                          Sign In
                        </Button>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
};

export default AppLayout;