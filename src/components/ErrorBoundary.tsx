import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal.";
      try {
        // Check if it's a Firestore error JSON
        if (this.state.error?.message.startsWith('{')) {
          const errInfo = JSON.parse(this.state.error.message);
          errorMessage = `Error de base de datos: ${errInfo.error || 'Permisos insuficientes'}`;
        } else {
          errorMessage = this.state.error?.message || errorMessage;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 text-red-600 mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">¡Vaya! Algo ha fallado</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <div className="space-y-3">
              <Button 
                onClick={this.handleReset}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold"
              >
                <RefreshCw size={18} className="mr-2" />
                Reintentar
              </Button>
              <Button 
                variant="ghost"
                onClick={() => window.location.href = '/'}
                className="w-full text-gray-400 hover:text-gray-600 rounded-xl h-12"
              >
                Volver al inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
