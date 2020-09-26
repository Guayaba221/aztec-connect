import React from 'react';
import { useQuery } from 'react-apollo';
import styled from 'styled-components';
import { spacings } from '../styles';
import { BlockItem, BlockItemPlaceholder } from './block_item';
import { GET_BLOCKS, BLOCKS_POLL_INTERVAL, BlocksQueryData, BlocksQueryVars } from './query';

const BlockRowRoot = styled.div`
  margin-top: -${spacings.s};
`;

const BlockRow = styled.div`
  padding: ${spacings.s} 0;
`;

interface BlockListProps {
  page: number;
  blocksPerPage: number;
}

export const BlockList: React.FunctionComponent<BlockListProps> = ({ page, blocksPerPage }) => {
  const { loading, error, data } = useQuery<BlocksQueryData, BlocksQueryVars>(GET_BLOCKS, {
    variables: {
      take: blocksPerPage,
      skip: Math.max(0, blocksPerPage * (page - 1)),
      where: { ethTxHash_not_null: true },
    },
    pollInterval: BLOCKS_POLL_INTERVAL,
  });

  if (loading || !data) {
    return (
      <BlockRowRoot>
        {[...Array(blocksPerPage)].map((_, i) => (
          <BlockRow key={+i}>
            <BlockItemPlaceholder />
          </BlockRow>
        ))}
      </BlockRowRoot>
    );
  }

  if (error) return <div>Error</div>;

  return (
    <BlockRowRoot>
      {data.blocks.map((block) => (
        <BlockRow key={block.id}>
          <BlockItem block={block} />
        </BlockRow>
      ))}
    </BlockRowRoot>
  );
};