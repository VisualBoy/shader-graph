import { css } from '@emotion/react';

export const canvasWrapperStyles = css`
    position: relative;
    width: 100%;
    height: 100%;
    overflow: auto;
`;

export const canvasContentStyles = (size: { width: number; height: number }) => css`
    position: relative;
    width: ${size.width}px;
    height: ${size.height}px;
    background-color: #0b0d14;
    background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1.2px, transparent 1.2px);
    background-position: 0 0;
    background-size: 24px 24px;
`;
