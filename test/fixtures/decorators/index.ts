const printMemberName = (target: any, memberName: string) => {
    console.log(memberName);
  };
  
class Person {
    // @ts-expect-error
    @printMemberName
    name: string = "Jon";
}