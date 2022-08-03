import * as React from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import TermsOfService from '../TermsOfService';

import './styles.scss';

export default function ScrollableDialog(props: {
    handleClose: () => void;
    title: string;
}) {
    return (
        <div className="terms-dialog">
            <Dialog
                open={true}
                onClose={props.handleClose}
                scroll="paper"
                aria-labelledby="scroll-dialog-title"
                aria-describedby="scroll-dialog-description"
                fullScreen={true}
                transitionDuration={1000}
            >
                <DialogTitle id="scroll-dialog-title">
                    {props.title}
                </DialogTitle>
                <DialogContent dividers={true}>
                    <DialogContentText
                        id="scroll-dialog-description"
                        tabIndex={-1}
                    >
                        <TermsOfService />
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={props.handleClose}>Close</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
