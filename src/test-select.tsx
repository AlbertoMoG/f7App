import { Select } from '@base-ui/react/select';
import * as React from 'react';

export function Test() {
  return (
    <Select.Root>
      <Select.Item value="1" fakeProp="test">Test</Select.Item>
    </Select.Root>
  );
}
