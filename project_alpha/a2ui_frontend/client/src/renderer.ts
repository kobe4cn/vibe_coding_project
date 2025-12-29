/**
 * A2UI Renderer - Renders A2UI components to DOM
 */
import { LitElement, html, css, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Component, BoundValue, Action, Children, ExplicitChildren } from './types';
import { DataModel } from './data-model';

/**
 * Main A2UI Surface element
 */
@customElement('a2ui-surface')
export class A2UISurface extends LitElement {
  @property({ type: String }) surfaceId = 'main';
  @state() private components: Map<string, Component> = new Map();
  @state() private rootId: string | null = null;

  dataModel: DataModel = new DataModel();

  private actionHandler: ((action: Action, sourceId: string, contextPath?: string) => void) | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  setComponents(components: Component[]): void {
    this.components.clear();
    for (const comp of components) {
      this.components.set(comp.id, comp);
    }
    this.requestUpdate();
  }

  setRoot(rootId: string): void {
    this.rootId = rootId;
    this.requestUpdate();
  }

  setActionHandler(handler: (action: Action, sourceId: string, contextPath?: string) => void): void {
    this.actionHandler = handler;
  }

  handleAction(action: Action, sourceId: string, contextPath?: string): void {
    if (this.actionHandler) {
      this.actionHandler(action, sourceId, contextPath);
    }
  }

  render() {
    if (!this.rootId) {
      return html`<slot></slot>`;
    }

    const rootComponent = this.components.get(this.rootId);
    if (!rootComponent) {
      return html`<div class="error">Root component not found: ${this.rootId}</div>`;
    }

    return this.renderComponent(rootComponent);
  }

  private renderComponent(comp: Component, contextPath?: string): TemplateResult | typeof nothing {
    const componentType = Object.keys(comp.component)[0];
    const props = comp.component[componentType] as Record<string, unknown>;

    switch (componentType) {
      case 'Text':
        return this.renderText(comp.id, props, contextPath);
      case 'Button':
        return this.renderButton(comp.id, props, contextPath);
      case 'TextField':
        return this.renderTextField(comp.id, props, contextPath);
      case 'Column':
        return this.renderColumn(comp.id, props, contextPath);
      case 'Row':
        return this.renderRow(comp.id, props, contextPath);
      case 'Card':
        return this.renderCard(comp.id, props, contextPath);
      case 'List':
        return this.renderList(comp.id, props, contextPath);
      case 'Icon':
        return this.renderIcon(comp.id, props, contextPath);
      case 'Divider':
        return this.renderDivider(comp.id);
      case 'Modal':
        return this.renderModal(comp.id, props, contextPath);
      case 'CheckBox':
        return this.renderCheckBox(comp.id, props, contextPath);
      default:
        console.warn(`Unknown component type: ${componentType}`);
        return html`<div class="unknown-component">[${componentType}]</div>`;
    }
  }

  private resolveValue(value: BoundValue | undefined, contextPath?: string): unknown {
    if (!value) return undefined;
    return this.dataModel.resolve(value, contextPath);
  }

  private renderText(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const text = this.resolveValue(props.text as BoundValue, contextPath) ?? '';
    const usageHint = props.usageHint as string | undefined;

    return html`
      <a2ui-text
        id=${id}
        data-usage-hint=${usageHint || nothing}
      >${text}</a2ui-text>
    `;
  }

  private renderButton(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const childId = props.child as string;
    const action = props.action as Action;

    const handleClick = () => {
      if (action) {
        // Pass contextPath so relative paths in action.context can be resolved
        this.handleAction(action, id, contextPath);
      }
    };

    return html`
      <a2ui-button id=${id} @click=${handleClick}>
        ${this.renderChildById(childId, contextPath)}
      </a2ui-button>
    `;
  }

  private renderTextField(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const label = this.resolveValue(props.label as BoundValue, contextPath) ?? '';
    const text = this.resolveValue(props.text as BoundValue, contextPath) ?? '';
    const textFieldType = props.textFieldType as string | undefined;

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      // Update data model with new value
      const textProp = props.text as BoundValue;
      if (textProp && 'path' in textProp) {
        // Note: This would need proper two-way binding implementation
        console.log(`TextField ${id} changed to: ${target.value}`);
      }
    };

    if (textFieldType === 'multiline') {
      return html`
        <a2ui-textfield id=${id}>
          <textarea
            placeholder=${label}
            .value=${text}
            @input=${handleInput}
            rows="4"
          ></textarea>
        </a2ui-textfield>
      `;
    }

    return html`
      <a2ui-textfield id=${id}>
        <input
          type="text"
          placeholder=${label}
          .value=${text}
          @input=${handleInput}
        />
      </a2ui-textfield>
    `;
  }

  private renderColumn(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = this.renderChildren(props.children as Children, contextPath);
    const alignment = props.alignment as string | undefined;
    const distribution = props.distribution as string | undefined;

    return html`
      <a2ui-column
        id=${id}
        data-alignment=${alignment || nothing}
        data-distribution=${distribution || nothing}
      >
        ${children}
      </a2ui-column>
    `;
  }

  private renderRow(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = this.renderChildren(props.children as Children, contextPath);
    const alignment = props.alignment as string | undefined;
    const distribution = props.distribution as string | undefined;

    return html`
      <a2ui-row
        id=${id}
        data-alignment=${alignment || nothing}
        data-distribution=${distribution || nothing}
      >
        ${children}
      </a2ui-row>
    `;
  }

  private renderCard(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const childId = props.child as string;

    return html`
      <a2ui-card id=${id}>
        ${this.renderChildById(childId, contextPath)}
      </a2ui-card>
    `;
  }

  private renderList(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const children = props.children as Children;
    const direction = props.direction as string || 'vertical';

    let content: unknown;

    if ('template' in children) {
      // Template-based list
      const template = children.template;
      const dataBinding = template.dataBinding;
      const entries = this.dataModel.getEntries(dataBinding);

      content = entries.map(entry => {
        const itemContextPath = entry.path;
        const templateComponent = this.components.get(template.componentId);
        if (templateComponent) {
          return this.renderComponent(templateComponent, itemContextPath);
        }
        return html``;
      });
    } else {
      // Explicit list
      content = this.renderChildren(children, contextPath);
    }

    return html`
      <a2ui-list id=${id} data-direction=${direction}>
        ${content}
      </a2ui-list>
    `;
  }

  private renderIcon(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const name = this.resolveValue(props.name as BoundValue, contextPath) ?? '';

    return html`
      <a2ui-icon id=${id}>
        <span class="material-icons">${name}</span>
      </a2ui-icon>
    `;
  }

  private renderDivider(id: string): TemplateResult {
    return html`<a2ui-divider id=${id}></a2ui-divider>`;
  }

  private renderModal(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    // Modal rendering - simplified version
    const entryPointChild = props.entryPointChild as string;
    const contentChild = props.contentChild as string;

    return html`
      <a2ui-modal id=${id}>
        <div slot="entry">${this.renderChildById(entryPointChild, contextPath)}</div>
        <div slot="content">${this.renderChildById(contentChild, contextPath)}</div>
      </a2ui-modal>
    `;
  }

  private renderCheckBox(id: string, props: Record<string, unknown>, contextPath?: string): TemplateResult {
    const label = this.resolveValue(props.label as BoundValue, contextPath) ?? '';
    const value = this.resolveValue(props.value as BoundValue, contextPath) ?? false;

    return html`
      <a2ui-checkbox id=${id}>
        <label>
          <input type="checkbox" .checked=${Boolean(value)} />
          ${label}
        </label>
      </a2ui-checkbox>
    `;
  }

  private renderChildren(children: Children | undefined, contextPath?: string): unknown {
    if (!children) return nothing;

    if ('explicitList' in children) {
      return (children as ExplicitChildren).explicitList.map(childId =>
        this.renderChildById(childId, contextPath)
      );
    }

    // Template children are handled in renderList
    return nothing;
  }

  private renderChildById(childId: string, contextPath?: string): TemplateResult | typeof nothing {
    const child = this.components.get(childId);
    if (!child) {
      console.warn(`Child component not found: ${childId}`);
      return html``;
    }
    return this.renderComponent(child, contextPath);
  }
}

// Define custom elements for styling (exported to avoid unused warnings)
@customElement('a2ui-text')
export class A2UIText extends LitElement {
  static styles = css`
    :host {
      display: inline;
    }
    :host([data-usage-hint="h1"]) {
      display: block;
      font-size: 36px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
    }
    :host([data-usage-hint="h2"]) {
      display: block;
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
    }
    :host([data-usage-hint="h3"]) {
      display: block;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
    }
    :host([data-usage-hint="h4"]) {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-button')
export class A2UIButton extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #FFD93D;
      color: #1E3A5F;
      border: none;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 150ms ease;
    }
    :host(:hover) {
      background: #FFE566;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-textfield')
export class A2UITextField extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    ::slotted(input),
    ::slotted(textarea) {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-family: inherit;
      font-size: 16px;
    }
    ::slotted(input:focus),
    ::slotted(textarea:focus) {
      outline: none;
      border-color: #FFD93D;
      box-shadow: 0 0 0 3px rgba(255, 217, 61, 0.2);
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-column')
export class A2UIColumn extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    :host([data-alignment="center"]) {
      align-items: center;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-row')
export class A2UIRow extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      gap: 16px;
      align-items: center;
    }
    :host([data-distribution="spaceBetween"]) {
      justify-content: space-between;
    }
    :host([data-distribution="center"]) {
      justify-content: center;
    }
    :host([data-distribution="end"]) {
      justify-content: flex-end;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-card')
export class A2UICard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      transition: box-shadow 200ms ease, transform 200ms ease;
    }
    :host(:hover) {
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-list')
export class A2UIList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: 12px;
    }
    :host([data-direction="vertical"]) {
      flex-direction: column;
    }
    :host([data-direction="horizontal"]) {
      flex-direction: row;
      flex-wrap: wrap;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-icon')
export class A2UIIcon extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

@customElement('a2ui-divider')
export class A2UIDivider extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 1px;
      background: #E5E7EB;
      margin: 16px 0;
    }
  `;

  render() {
    return html``;
  }
}

@customElement('a2ui-modal')
export class A2UIModal extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  render() {
    return html`
      <slot name="entry"></slot>
      <slot name="content"></slot>
    `;
  }
}

@customElement('a2ui-checkbox')
export class A2UICheckBox extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }
    label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #FFD93D;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'a2ui-surface': A2UISurface;
  }
}
