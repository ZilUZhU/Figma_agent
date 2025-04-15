// CSS模块声明
declare module "*.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// 声明其他模块类型（如果需要）
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
} 