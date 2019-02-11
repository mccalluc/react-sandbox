import React from 'react';
import PubSub from 'pubsub-js';
import {
  IMAGE_ADD, MOLECULES_ADD, CELLS_ADD, STATUS_INFO,
  CELLS_SELECTION, SELECTION_MODE_SET, POINT, RECT
} from '../../events';
import Spatial from './Spatial';


export class SpatialSubscriber extends React.Component {
  constructor(props) {
    super(props);
    this.state = {baseImgUrl: undefined, cells: {}, selectedCellIds: {}, isRectangleSelection: false};
  }

  componentWillMount() {
    this.imageToken = PubSub.subscribe(IMAGE_ADD, this.imageAddSubscriber.bind(this));
    this.moleculesToken = PubSub.subscribe(MOLECULES_ADD, this.moleculesAddSubscriber.bind(this));
    this.cellsAddToken = PubSub.subscribe(CELLS_ADD, this.cellsAddSubscriber.bind(this));
    this.cellsSelectionToken = PubSub.subscribe(CELLS_SELECTION, this.cellsSelectionSubscriber.bind(this));
    this.selectionModeSetToken = PubSub.subscribe(SELECTION_MODE_SET, this.selectionModeSetSubscriber.bind(this));
  }

  componentWillUnmount() {
    PubSub.unsubscribe(this.imageToken);
    PubSub.unsubscribe(this.moleculesToken);
    PubSub.unsubscribe(this.cellsAddToken);
    PubSub.unsubscribe(this.cellsSelectionToken);
    PubSub.unsubscribe(this.selectionModeSetToken);
  }

  imageAddSubscriber(msg, baseImg) {
    this.setState({baseImg: baseImg});
  }

  moleculesAddSubscriber(msg, molecules) {
    this.setState({molecules: molecules});
  }

  cellsAddSubscriber(msg, cells) {
    this.setState({cells: cells});
  }

  cellsSelectionSubscriber(msg, cellIds) {
    this.setState({selectedCellIds: cellIds});
  }

  selectionModeSetSubscriber(msg, mode) {
    if (mode === POINT) {
      this.setState({isRectangleSelection: false});
    } else if (mode === RECT) {
      this.setState({isRectangleSelection: true});
    } else {
      throw new Error(`Unrecognized mode: ${mode}`)
    }
  }

  render() {
    return (
      <Spatial
        baseImg={this.state.baseImg}
        molecules={this.state.molecules}
        cells={this.state.cells}
        selectedCellIds={this.state.selectedCellIds}
        isRectangleSelection={this.state.isRectangleSelection}
        updateStatus={(message) => PubSub.publish(STATUS_INFO, message)}
        updateCellsSelection={(selectedCellIds) => PubSub.publish(CELLS_SELECTION, selectedCellIds)}
      />
    );
  }
}
