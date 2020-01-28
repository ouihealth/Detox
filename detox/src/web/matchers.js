const invoke = require('../invoke');
const GreyMatchers = require('../ios/earlgreyapi/GREYMatchers');
const GreyMatchersDetox = require('../ios/earlgreyapi/GREYMatchers+Detox');

class Matcher {
  withAncestor(matcher) {
    const _originalMatcherCall = this._call;
    this._call = invoke.callDirectly(GreyMatchersDetox.detoxMatcherForBothAndAncestorMatcher(_originalMatcherCall, matcher._call));
    return this;
  }
  withDescendant(matcher) {
    const _originalMatcherCall = this._call;
    this._call = invoke.callDirectly(GreyMatchersDetox.detoxMatcherForBothAndDescendantMatcher(_originalMatcherCall, matcher._call));
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

class LabelMatcher extends Matcher {
  constructor(value) {
    super();
    this._call = invoke.callDirectly(GreyMatchersDetox.detox_matcherForAccessibilityLabel(value));
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
    this._call = GreyMatchers.matcherForNotNil();
  }
}

class NotExistsMatcher extends Matcher {
  constructor() {
    super();
    this._call = GreyMatchers.matcherForNil();
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
  ValueMatcher
};
