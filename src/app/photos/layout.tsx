import { AuthProvider } from "@/contexts/AuthContext";
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
      <FloatingChatProvider>
        <StripeErrorHandler />
        <div className="min-h-screen bg-gray-50">
          {children}
          <FloatingChatContainer />
        </div>
      </FloatingChatProvider>
    </AuthProvider>
  );
}

