import type { ReactNode } from 'react';
import { Card } from '@/components/Card/Card';

interface Props {
  title: string;
  assignee: ReactNode;
}

export function SelectedTask({ title, assignee }: Props) {
  return <Card title={title}>{assignee}</Card>;
}
