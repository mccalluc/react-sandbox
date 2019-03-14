import React from 'react';
import PubSub from 'pubsub-js';
import { FACTORS_ADD, CELLS_COLOR } from '../../events';
import Heatmap from './Heatmap';
import { PALETTE } from '../utils';

export default class HeatmapSubscriber extends React.Component {
  constructor(props) {
    super(props);
    this.state = { factors: {}, selectedId: 'cluster' };
    this.setSelectedFactor = this.setSelectedFactor.bind(this);
  }

  componentWillMount() {
    this.factorsAddToken = PubSub.subscribe(
      FACTORS_ADD, this.factorsAddSubscriber.bind(this),
    );
  }

  componentWillUnmount() {
    PubSub.unsubscribe(this.factorsAddToken);
  }

  factorsAddSubscriber(msg, factors) {
    this.setState({ factors });
  }

  setSelectedFactor(selectedId) {
    this.setState({ selectedId });
    const { factors } = this.state;
    const cellColors = {};

    const factorColors = {};
    Object.entries(factors[selectedId].cells).forEach(
      ([cellId, factorIndex]) => {
        if (!factorColors[factorIndex]) {
          const nextColorIndex = Object.keys(factorColors).length;
          factorColors[factorIndex] = PALETTE[nextColorIndex % PALETTE.length];
        }
        cellColors[cellId] = factorColors[factorIndex];
      },
    );
    PubSub.publish(CELLS_COLOR, cellColors);
  }

  render() {
    const { factors, selectedId } = this.state;
    const factorsSelected = {};
    Object.keys(factors).forEach((factorId) => {
      factorsSelected[factorId] = factorId === selectedId;
    });
    return (
      <Heatmap
        factorsSelected={factorsSelected}
        setSelectedFactor={this.setSelectedFactor}
      />
    );
  }
}
