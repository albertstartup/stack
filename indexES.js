import { createStore, applyMiddleware } from 'redux'
import { connect } from 'react-redux'
import React from 'react'
import ReactDOM from 'react-dom'
import _ from 'underscore'
import moment from 'moment'

const logger = store => next => action => {
  var result = next(action)
  var currentStack = JSON.parse(localStorage.getItem('stack')) || [];
  var task = {
    id: Math.floor(Math.random() * 1000000000),
    timestamp: Date.now(),
    stack: store.getState()
  };
  var finalStack = [...currentStack, task];
  localStorage.setItem('stack', JSON.stringify(finalStack));
  return result
}

const stack = (state = [], action) => {
  switch (action.type) {
    case 'PUSH':
      return [...state, {
        id: Math.floor(Math.random() * 1000000000),
        title: action.value,
        start: Date.now()
      }];
    case 'POP':
      const index = _.findLastIndex(state, function(task) {
        return task.id == action.id;
      });
      return state.slice(0, index);
    default:
      return state;
  }
};

const store = createStore(stack,
  (() => {
    var stack = JSON.parse(localStorage.getItem('stack'))
    if (stack) return stack.pop().stack
    return []
  })(),
  applyMiddleware(logger)
);

window.store = store

class Task extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      title: props.task.title,
      id: props.task.id,
      start: props.task.start,
      hours: moment(Date.now()).diff(props.task.start, 'hours')%24,
      minutes: moment(Date.now()).diff(props.task.start, 'minutes')%60,
      seconds: moment(Date.now()).diff(props.task.start, 'seconds')%60
    }
    this.onClick = props.onClick;
  }
  componentDidMount() {
    this.interval = setInterval(() => {
      this.setState({
        hours: moment(Date.now()).diff(this.state.start, 'hours')%24,
        minutes: moment(Date.now()).diff(this.state.start, 'minutes')%60,
        seconds: moment(Date.now()).diff(this.state.start, 'seconds')%60
      });
    }, 1000);
  }
  componentWillUnmount() {
    clearInterval(this.interval)
  }
  render() {
    return <div data-id={this.state.id} onClick={(event) => this.onClick(event)}>
      {this.state.title}
      <br/>
      {this.state.hours}:{this.state.minutes}:{this.state.seconds}
    </div>
  }
}

const Stack = ({tasks, onSubmit, onClick}) => (
  <div>
    <form onSubmit={onSubmit}>
      <input/>
    </form>
    {
      (_.map(tasks, (task) => {
        return <Task task={task} onClick={onClick} key={task.id} />
      })).reverse()
    }
  </div>
);

const mapStateToProps = (state) => {
  return {
    tasks: state
  };
}

const mapDispatchToProps = (dispatch) => {
  return {
    onSubmit: (event) => {
      event.preventDefault();
      dispatch({
        type: 'PUSH',
        id: Math.floor(Math.random() * 1000000000),
        value: event.target.childNodes[0].value
      });
    },
    onClick: (event) => {
      dispatch({
        type: 'POP',
        id: event.target.getAttribute('data-id')
      });
    }
  };
};

const StackContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Stack);

ReactDOM.render(
  <StackContainer store={store} />,
  document.getElementById('root')
);
