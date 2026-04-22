import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Businesses from "@/pages/businesses";
import BusinessDetail from "@/pages/business-detail";
import MapView from "@/pages/map";
import PipelinePage from "@/pages/pipeline";
import Admin from "@/pages/admin";
import ResearchPage from "@/pages/research";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/businesses/:id">
          {(params) => <BusinessDetail params={params as { id: string }} />}
        </Route>
        <Route path="/businesses" component={Businesses} />
        <Route path="/map" component={MapView} />
        <Route path="/research" component={ResearchPage} />
        <Route path="/pipeline" component={PipelinePage} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
