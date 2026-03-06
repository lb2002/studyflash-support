"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Moon, Sun } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/team-members")
      .then((r) => r.json())
      .then((data) => {
        setTeamMembers(data);
        // Restore from localStorage or default to first
        const saved = localStorage.getItem("currentUserId");
        if (saved && data.find((m: TeamMember) => m.id === saved)) {
          setCurrentUser(saved);
        } else if (data.length > 0) {
          setCurrentUser(data[0].id);
          localStorage.setItem("currentUserId", data[0].id);
        }
      });
  }, []);

  const selected = teamMembers.find((m) => m.id === currentUser);

  const handleChange = (value: string) => {
    setCurrentUser(value);
    localStorage.setItem("currentUserId", value);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-3">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        )}
        <span className="text-sm text-muted-foreground">Acting as:</span>
        <Select value={currentUser} onValueChange={handleChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            {teamMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  {member.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
