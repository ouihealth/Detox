const invoke = require('../invoke');
const GreyMatchers = require('../ios/earlgreyapi/GREYMatchers');
const GreyMatchersDetox = require('../ios/earlgreyapi/GREYMatchers+Detox');

class Matcher {
  withAncestor(matcher) {
    const _originalMatcherCall = this._call;
    if (_originalMatcherCall.method === 'selector' && matcher._call.method === 'selector') {
      this._call = {
        ..._originalMatcherCall,
        args: [...matcher._call.args, ..._originalMatcherCall.args]
      };
    } else {
      throw new Error('Complex withAncestor not supported');
    }
    return this;
  }
  withDescendant(matcher) {
    const _originalMatcherCall = this._call;
    if (_originalMatcherCall.method === 'selector' && matcher._call.method === 'selector') {
      this._call = {
        ..._originalMatcherCall,
        // TODO this logic isn't right. We want to return the parent part of the selector in this case
        // Need a more generic function that selectElementWithMatcher that takes an optional root element
        args: [..._originalMatcherCall.args, ...matcher._call.args]
      };
    } else {
      throw new Error('Complex withDescendent not supported');
    }
    return this;
  }
  and(matcher) {
    const _originalMatcherCall = this._call;
    // this._call = invoke.callDirectly(GreyMatchersDetox.detoxMatcherForBothAnd(_originalMatcherCall, matcher._call));
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'and',
      args: [_originalMatcherCall, matcher._call]
    };
    return this;
  }
  not() {
    const _originalMatcherCall = this._call;
    this._call = invoke.callDirectly(GreyMatchersDetox.detoxMatcherForNot(_originalMatcherCall));
    return this;
  }
  _avoidProblematicReactNativeElements() {
    const _originalMatcherCall = this._call;
    this._call = invoke.callDirectly(GreyMatchersDetox.detoxMatcherAvoidingProblematicReactNativeElements(_originalMatcherCall));
    return this;
  }
  _extendToDescendantScrollViews() {
    const _originalMatcherCall = this._call;
    this._call = invoke.callDirectly(GreyMatchersDetox.detoxMatcherForScrollChildOfMatcher(_originalMatcherCall));
    return this;
  }
  _extendPickerViewMatching() {
    const _originalMatcherCall = this._call;
    this._call = invoke.callDirectly(GreyMatchersDetox.detoxMatcherForPickerViewChildOfMatcher(_originalMatcherCall));
    return this;
  }
}

class IndexMatcher extends Matcher {
  constructor(value) {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'index',
      args: [value]
    };
  }
}

class LabelMatcher extends Matcher {
  constructor(value) {
    super();
    // TODO change to accessibilityLabel
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'containsText',
      args: [value]
    };
  }
}

class IdMatcher extends Matcher {
  constructor(value) {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'selector',
      args: [`[data-testid="${value}"]`]
    };
  }
}

class TypeMatcher extends Matcher {
  constructor(value) {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'selector',
      args: [`${value}`]
    };
  }
}

// iOS only, just a dummy matcher here
class TraitsMatcher extends Matcher {
  constructor(value) {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'selector',
      args: [`*`]
    };
  }
}

class VisibleMatcher extends Matcher {
  constructor() {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'option',
      args: [{ visible: true }]
    };
  }
}

class NotVisibleMatcher extends Matcher {
  constructor() {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'option',
      args: [{ visible: false }]
    };
  }
}

class ExistsMatcher extends Matcher {
  constructor() {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'option',
      args: [{ exists: true }]
    };
  }
}

class NotExistsMatcher extends Matcher {
  constructor() {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'option',
      args: [{ exists: false }]
    };
  }
}

class TextMatcher extends Matcher {
  constructor(value) {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'containsText',
      args: [value]
    };
  }
}

class ValueMatcher extends Matcher {
  constructor(value) {
    super();
    this._call = {
      target: {
        type: 'matcher',
        value: 'matcher'
      },
      method: 'selector',
      args: [`[value="${value}"]`]
    };
  }
}

module.exports = {
  Matcher,
  LabelMatcher,
  IdMatcher,
  TypeMatcher,
  TraitsMatcher,
  VisibleMatcher,
  NotVisibleMatcher,
  ExistsMatcher,
  NotExistsMatcher,
  TextMatcher,
  IndexMatcher,
  ValueMatcher
};
