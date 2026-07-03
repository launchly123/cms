/** What's currently selected in the visual editor canvas. */
export type Selection =
  | {
      kind: "text";
      label: string;
      target: "page";
      field: "hero_heading" | "hero_subheading" | "title";
      multiline?: boolean;
    }
  | {
      kind: "image";
      label: string;
      target: "page";
      field: "hero_image_url";
    }
  | {
      kind: "text";
      label: string;
      target: "section";
      sectionId: string;
      field: "heading" | "body";
      multiline?: boolean;
    }
  | {
      kind: "image";
      label: string;
      target: "section";
      sectionId: string;
      field: "image_url";
    }
  | {
      kind: "text";
      label: string;
      target: "post";
      field: "title" | "excerpt";
      multiline?: boolean;
    }
  | {
      kind: "image";
      label: string;
      target: "post";
      field: "featured_image_url";
    };
