import React from 'react';
import { ActionIcon, Box, Flex, Title } from '@mantine/core';
import { IconLayoutSidebarLeftExpand, IconMenu2 } from '@tabler/icons-react';
import clsx from 'clsx';
import type { FC } from 'react';

import { useIsSmallScreen, useUIStore } from './store';

export type PageProps = {
  children?: React.ReactNode;
  title: string | React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export const Page: FC<PageProps> = ({ children, title, left, right }) => {
  const showSidebar = useUIStore((s) => s.showSidebar);
  const setShowSidebar = useUIStore((s) => s.setShowSidebar);
  const isSmallScreen = useIsSmallScreen();
  const needRoomForMacWindowControls = false;
  return (
    <div className="flex flex-col h-full min-h-0">
      <Flex
        h={48}
        align="center"
        px="md"
        className={clsx('title-bar', isSmallScreen ? 'bg-chatbox-background-primary' : '')}
      >
        {left ||
          ((!showSidebar || isSmallScreen) && (
            <Flex align="center" className={needRoomForMacWindowControls ? 'pl-20' : ''}>
              <ActionIcon
                className="controls"
                aria-label="展开侧栏"
                variant="subtle"
                size={isSmallScreen ? 24 : 20}
                color={isSmallScreen ? 'chatbox-secondary' : 'chatbox-tertiary'}
                mr="xs"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                {isSmallScreen ? <IconMenu2 /> : <IconLayoutSidebarLeftExpand />}
              </ActionIcon>
            </Flex>
          ))}

        <Flex align="center" gap={'xxs'} flex={1} {...(isSmallScreen ? { justify: 'center', px: 'sm' } : {})}>
          {typeof title === 'string' ? (
            <Title order={4} fz={18} lineClamp={1}>
              {title}
            </Title>
          ) : (
            title
          )}
        </Flex>
        {right}

        {isSmallScreen && !right && <Box w={28} />}
      </Flex>

      <div className="flex-1 overflow-auto min-h-0">{children}</div>
    </div>
  );
};

export default Page;
