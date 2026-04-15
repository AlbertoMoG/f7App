import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LazyTopPlayersCardProps<T> {
  title: string;
  description: string;
  calculate: () => T[];
  renderItem: (item: T, i: number) => React.ReactNode;
}

export function LazyTopPlayersCard<T>({ title, description, calculate, renderItem }: LazyTopPlayersCardProps<T>) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [calculatedData, setCalculatedData] = React.useState<T[]>([]);

  React.useEffect(() => {
    if (isExpanded) {
      setCalculatedData(calculate());
    }
  }, [isExpanded, calculate]);

  const handleShow = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isExpanded ? (
          <Button variant="outline" onClick={handleShow} className="w-full">
            Mostrar Top
          </Button>
        ) : (
          <div className="space-y-3">
            {calculatedData.map((item, i) => renderItem(item, i))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
