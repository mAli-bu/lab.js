import React, { Fragment } from 'react'

import { FieldArray, useFormikContext } from 'formik'
import { Button } from 'reactstrap'

import Icon from '../Icon'
import './table.css'

const FormArray = ({
  name, item: Item,
  header: Header, footer: Footer,
  wrapper: Wrapper=Fragment,
  wrapperProps,
  bodyWrapper: BodyWrapper=Fragment,
  defaultItem={},
}) => {
  const { values }  = useFormikContext()

  return (
    <FieldArray name={ name }>
      {
        arrayHelpers => <Wrapper { ...wrapperProps }>
          { Header && <Header /> }
          <BodyWrapper>
            {
              (values[name] || []).map(
                (data, index) =>
                  <Item
                    key={ `${ name }[${ index }]` }
                    name={ `${ name }[${ index }]` }
                    index={ index }
                    data={ data }
                    arrayHelpers={ arrayHelpers }
                  />
              )
            }
          </BodyWrapper>
          { Footer && <Footer addItem={ (item) => arrayHelpers.push(item || defaultItem) } /> }
        </Wrapper>
      }
    </FieldArray>
  )
}

export const ButtonCell = ({ icon, onClick, style, disabled=false, type }) => {
  const Wrapper = type ?? 'td'

  return (
    <Wrapper>
      <Button
        block outline color="muted"
        onClick={ onClick }
        style={ style }
        disabled={ disabled }
      >
        <Icon icon={ icon } />
      </Button>
    </Wrapper>
  )
}

const DefaultColgroup = ({ name, columns=1 }) =>
  <colgroup>
    <col style={{ width: '5%' }} />
    {
      (new Array(columns)).fill(null).map(
        (_, i) => <col
          key={ `table-${ name }-colgroup-${ i }` }
          style={{ width: `${ 90/columns }%` }}
        />
      )
    }
    <col style={{ width: '5%' }} />
  </colgroup>

export const DefaultRow = ({
  index, arrayHelpers, children,
  leftColumn: LeftColumn,
  wrapper: Wrapper='td'
}) =>
  <tr>
    { LeftColumn ? <LeftColumn /> : <ButtonCell icon="bars" /> }
    <Wrapper>
      { children }
    </Wrapper>
    <ButtonCell
      icon="trash"
      onClick={ () => arrayHelpers.remove(index) }
    />
  </tr>

const DefaultFooter = ({ addItem, columns }) =>
  <tfoot>
    <tr>
      <td></td>
      <td colSpan={ columns }>
        <Button
          block size="sm"
          outline color="muted"
          className="hover-target"
          onClick={ () => addItem() }
        >
          <Icon icon="plus" />
        </Button>
      </td>
      <td></td>
    </tr>
  </tfoot>

export const Table = ({
  header: Header,
  row,
  footer: Footer=DefaultFooter,
  columns=1,
  className, ...props
}) =>
  <FormArray
    wrapper="table"
    wrapperProps={{ className: `table grid ${ className }` }}
    header={ () =>
      <>
        <DefaultColgroup name={ props.name } columns={ columns }/>
        { Header && <Header /> }
      </>
    }
    bodyWrapper="tbody"
    item={ row }
    footer={ (props) => <Footer columns={ columns } { ...props } /> }
    { ...props }
  />
