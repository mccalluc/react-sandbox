/* eslint-disable */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import PubSub from 'pubsub-js';

import TitleInfo from '../TitleInfo';
import {
  STATUS_INFO, VIEW_INFO,
} from '../../events';
import { pluralize, capitalize } from '../../utils';
import { useDeckCanvasSize, useReady, useUrls } from '../utils';
import { useCellsData, useCellSetsData, useExpressionMatrixData } from '../data-hooks';
import { getCellColors } from '../interpolate-colors';
import Heatmap from './Heatmap';
import HeatmapTooltipSubscriber from './HeatmapTooltipSubscriber';

import { useCoordination } from '../../app/state/hooks';
import { componentCoordinationTypes } from '../../app/state/coordination';

export default function HeatmapSubscriber(props) {
  const {
    uuid,
    loaders,
    coordinationScopes,
    removeGridComponent, theme, transpose,
    observationsLabelOverride: observationsLabel = 'cell',
    observationsPluralLabelOverride: observationsPluralLabel = `${observationsLabel}s`,
    variablesLabelOverride: variablesLabel = 'gene',
    variablesPluralLabelOverride: variablesPluralLabel = `${variablesLabel}s`,
    disableTooltip = false,
  } = props;

  // Get "props" from the coordination space.
  const [{
    dataset,
    heatmapZoomX: zoomX,
    heatmapTargetX: targetX,
    heatmapTargetY: targetY,
    geneSelection,
    cellSelection,
    cellSetSelection,
  }, {
    setHeatmapZoomX: setZoomX,
    setHeatmapZoomY: setZoomY,
    setHeatmapTargetX: setTargetX,
    setHeatmapTargetY: setTargetY,
    setCellHighlight,
    setGeneHighlight,
  }] = useCoordination(componentCoordinationTypes.heatmap, coordinationScopes);

  const observationsTitle = capitalize(observationsPluralLabel);
  const variablesTitle = capitalize(variablesPluralLabel);

  const [isRendering, setIsRendering] = useState(false);
  const [isReady, setItemIsReady, resetReadyItems] = useReady(
    ['cells', 'cell-sets', 'expression-matrix'],
  );
  const [urls, addUrl, resetUrls] = useUrls();
  const [width, height, deckRef] = useDeckCanvasSize();

  // Reset file URLs and loader progress when the dataset has changed.
  useEffect(() => {
    resetUrls();
    resetReadyItems();
  }, [loaders, dataset]);

  // Get data from loaders using the data hooks.
  const [cells] = useCellsData(loaders, dataset, setItemIsReady, addUrl, true);
  const [expressionMatrix] = useExpressionMatrixData(loaders, dataset, setItemIsReady, addUrl, true);
  const [cellSets] = useCellSetsData(loaders, dataset, setItemIsReady, addUrl, false);

  const cellColors = useMemo(() => {
    return getCellColors({
      expressionMatrix,
      geneSelection,
      cellColorEncoding: 'geneSelection',
      cellSets,
      cellSetSelection,
    });
  }, [geneSelection, cellSets, cellSetSelection, expressionMatrix]);

  const getCellInfo = useCallback((cellId) => {
    if (cellId) {
      const cellInfo = cells[cellId];
      return {
        [`${capitalize(observationsLabel)} ID`]: cellId,
        ...(cellInfo ? cellInfo.factors : {}),
      };
    }
    return null;
  }, [cells, observationsLabel]);

  const getGeneInfo = useCallback((geneId) => {
    if (geneId) {
      return { [`${capitalize(variablesLabel)} ID`]: geneId };
    }
    return null;
  }, [variablesLabel]);

  const cellsCount = expressionMatrix && expressionMatrix.rows
    ? expressionMatrix.rows.length : 0;
  const genesCount = expressionMatrix && expressionMatrix.cols
    ? expressionMatrix.cols.length : 0;
  const selectedCount = cellSelection ? cellSelection.length : 0;
  return (
    <TitleInfo
      title="Heatmap"
      info={`${cellsCount} ${pluralize(observationsLabel, observationsPluralLabel, cellsCount)} × ${genesCount} ${pluralize(variablesLabel, variablesPluralLabel, genesCount)},
             with ${selectedCount} ${pluralize(observationsLabel, observationsPluralLabel, selectedCount)} selected`}
      urls={urls}
      theme={theme}
      removeGridComponent={removeGridComponent}
      isReady={isReady && !isRendering}
    >
      <Heatmap
        ref={deckRef}
        transpose={transpose}
        viewState={{ zoom: zoomX, target: [targetX, targetY] }}
        setViewState={({ zoom, target }) => {
          setZoomX(zoom);
          setZoomY(zoom);
          setTargetX(target[0]);
          setTargetY(target[1]);
        }}
        height={height}
        width={width}
        theme={theme}
        uuid={uuid}
        expressionMatrix={expressionMatrix}
        cellColors={cellColors}
        setIsRendering={setIsRendering}
        setCellHighlight={setCellHighlight}
        setGeneHighlight={setGeneHighlight}
        updateStatus={message => PubSub.publish(STATUS_INFO, message)}
        updateViewInfo={viewInfo => PubSub.publish(VIEW_INFO, viewInfo)}
        observationsTitle={observationsTitle}
        variablesTitle={variablesTitle}
      />
      {!disableTooltip && (
      <HeatmapTooltipSubscriber
        uuid={uuid}
        width={width}
        height={height}
        transpose={transpose}
        getCellInfo={getCellInfo}
        getGeneInfo={getGeneInfo}
        coordinationScopes={coordinationScopes}
      />
      )}
    </TitleInfo>
  );
}