// @ts-expect-error -- the dependency is only installed during test
import EE from 'eventemitter3';

const ee = new EE();
ee.on('test', () => {
  console.log('test');
});
