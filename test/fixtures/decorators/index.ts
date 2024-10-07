function trace(value, {kind, name}) {
  if (kind === 'method') {
    return function (...args) {
      console.log('trace')
      return value.apply(this, args);
    };
  }
}

class People {
  xzy: string
  constructor(){
    this.xzy = 'xzy';
  }
  @trace
  test() {
    return this.xzy
  }
}

const p = new People();

p.test();
