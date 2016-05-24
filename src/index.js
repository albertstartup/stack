import { createStore, applyMiddleware } from 'redux'
import { connect } from 'react-redux'
import React from 'react'
import ReactDOM from 'react-dom'
import _ from 'underscore'
import moment from 'moment'
import config from './private/config.js'
import firebase from 'firebase'

const app = firebase.initializeApp(config.firebase);
window.app = app

const logger = store => next => action => {
  if (action.type === 'HYDRATE') return next(action)
  var result = next(action)
  var currentStack = JSON.parse(localStorage.getItem('stack')) || [];
  var task = {
    id: Math.floor(Math.random() * 1000000000),
    timestamp: Date.now(),
    stack: store.getState()
  };
  var finalStack = [...currentStack, task];
  var stringStack = JSON.stringify(finalStack)
  // Log to localStorage.
  localStorage.setItem('stack', stringStack);
  var user = app.auth().currentUser
  if (user) {
    var userStack = {};
    userStack[user.uid] = stringStack;
    // Log to Firebase.
    app.database().ref().update(userStack);
  }
  return result
}

const extractFromHydrate = (stringStack) => {
  var stack = JSON.parse(stringStack)
  if (stack) return stack.pop().stack
  return []
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
    case 'HYDRATE':
      return extractFromHydrate(action.value)
    default:
      return state;
  }
};

const store = createStore(stack,
  extractFromHydrate(localStorage.getItem('stack')),
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

class App extends React.Component {
  constructor(props) {
    super(props);
  }
  componentDidMount() {
    app.auth().onAuthStateChanged((user) => {
      this.forceUpdate()
      if (user) {
        var uid = user.uid;
        app.database().ref(uid).on('value', (snapshot) => {
          if (snapshot.val()) {
            store.dispatch({type: 'HYDRATE', value: snapshot.val()})
          }
        });
      }
    });
  }
  onLogin(event) {
    const email = this.emailInput.value;
    const password = this.passwordInput.value;
    app.auth().signInWithEmailAndPassword(email, password).catch((error) => {
      console.log(error)
    });
  }
  onCreate(event) {
    const email = this.emailInput.value;
    const password = this.passwordInput.value;
    app.auth().createUserWithEmailAndPassword(email, password, (error, userData) => {
      if (error) {
        console.log(error);
      }
    });
  }
  render() {
    var login;
    if (!app.auth().currentUser) {
      login = (<div>
        <input ref={(ref) => this.emailInput = ref} placeholder='Email'/>
        <input ref={(ref) => this.passwordInput = ref} placeholder='Password'/>
        <button onClick={(event) => this.onLogin()}>Log In</button>
        <button onClick={(event) => this.onCreate()}>Create Account</button>
      </div>)
    }
    return <div>
      {login}
      <br/>
      <StackContainer store={store} />
    </div>
  }
}

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
