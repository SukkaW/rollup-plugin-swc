function trace(_target: any, _name: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function () {
    console.log('trace');
    return original.call(this);
  };

  return descriptor;
}

class People {
  xzy: string;
  constructor() {
    this.xzy = 'xzy';
  }

  @trace
  test() {
    return this.xzy;
  }
}

const p = new People();

p.test();
