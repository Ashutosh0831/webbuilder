import { headingComponent } from "./heading";
import { paragraphComponent } from "./paragraph";
import { imageComponent } from "./image";
import { buttonComponent } from "./button";
import { containerComponent } from "./container";
import { columnsComponent } from "./columns";
import { heroComponent } from "./hero";
import { cardComponent } from "./card";
import { featureGridComponent } from "./feature-grid";
import { testimonialsComponent } from "./testimonials";
import { faqComponent } from "./faq";
import { spacerComponent } from "./spacer";
import { dividerComponent } from "./divider";
import { navigationComponent } from "./navigations";
import { footerComponent } from "./footer";

const defs = [
  headingComponent,
  paragraphComponent,
  imageComponent,
  buttonComponent,
  containerComponent,
  columnsComponent,
  heroComponent,
  cardComponent,
  featureGridComponent,
  testimonialsComponent,
  faqComponent,
  spacerComponent,
  dividerComponent,
  navigationComponent,
  footerComponent,
] as const;

export const componentRegistry = Object.fromEntries(
  defs.map((d) => [d.key, d] as const)
);

export function getComponentDefinition(key: string) {
  // Only keys present in the registry are resolvable
  return Object.prototype.hasOwnProperty.call(componentRegistry, key)
    ? componentRegistry[key]
    : null;
}