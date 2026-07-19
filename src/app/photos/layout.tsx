import { AuthProvider } from "@/contexts/AuthContext";
import { OperatorProvider } from "@/contexts/OperatorContext";
import { FloatingChatProvider } from "@/contexts/FloatingChatContext";
import FloatingChatContainer from "@/components/FloatingChatContainer";
import StripeErrorHandler from "@/components/StripeErrorHandler";

export default function PhotosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <OperatorProvider>
        <FloatingChatProvider>
          <StripeErrorHandler />
          <div className="min-h-screen app-page-bg">
            {children}
            <FloatingChatContainer />
          </div>
        </FloatingChatProvider>
      </OperatorProvider>
    </AuthProvider>
  );
}

