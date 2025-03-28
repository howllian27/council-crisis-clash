import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Game from "./pages/Game";
import GameLobby from "./components/GameLobby";
import NotFound from "./pages/NotFound";
import { MultiplayerProvider } from "./contexts/MultiplayerContext";
import WebSocketTest from "./components/WebSocketTest";
import "./App.css";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MultiplayerProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/lobby" element={<GameLobby />} />
            <Route path="/game" element={<Game />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MultiplayerProvider>
      </BrowserRouter>
      <WebSocketTest />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
